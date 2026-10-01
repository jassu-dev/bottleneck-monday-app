import initMondayClient from 'monday-sdk-js';
import prisma from '../db/prisma';

export interface MondayItem {
  id: string;
  name: string;
  board?: {
    id: string;
    name: string;
  };
  group?: {
    id: string;
    title: string;
  };
  column_values: Array<{
    id: string;
    title: string;
    type: string;
    text: string;
    value: string;
  }>;
}

export class MondayService {
  private defaultToken: string;

  constructor() {
    this.defaultToken = process.env.MONDAY_API_TOKEN || '';
  }

  /**
   * Resolves token: either customToken, customer token by accountId from DB, or fallback default token
   */
  async resolveToken(customToken?: string, accountId?: string): Promise<string> {
    if (customToken) return customToken;
    if (accountId) {
      const account = await prisma.account.findUnique({ where: { accountId } });
      if (account?.accessToken) return account.accessToken;
    }
    return this.defaultToken;
  }

  private getClient(token?: string) {
    const monday = initMondayClient();
    const activeToken = token || this.defaultToken;
    if (activeToken) {
      monday.setToken(activeToken);
    }
    return monday;
  }

  /**
   * Execute raw GraphQL query against monday.com API
   */
  async executeGraphQL<T = any>(query: string, variables: Record<string, any> = {}, token?: string): Promise<T> {
    const client = this.getClient(token);
    const activeToken = token || this.defaultToken;

    // If mock token or no real token provided in local dev, provide safe simulated responses
    if (!activeToken || activeToken === 'mock_or_actual_monday_api_token') {
      console.log(`[MondayService Mock] Executing simulated GraphQL query:`, { query: query.trim().split('\n')[0], variables });
      return this.mockGraphQLResponse(query, variables) as T;
    }

    try {
      const response = (await client.api(query, { variables })) as any;
      if (response && response.errors && response.errors.length > 0) {
        throw new Error(`Monday GraphQL error: ${response.errors.map((e: any) => e.message).join(', ')}`);
      }
      return response.data;
    } catch (error: any) {
      console.error('[MondayService] GraphQL execution failed:', error.message);
      throw error;
    }
  }

  /**
   * Fetch item details (name, board, group, column values)
   */
  async getItem(itemId: string, token?: string): Promise<MondayItem | null> {
    const query = `
      query GetItemDetails($itemId: [ID!]) {
        items(ids: $itemId) {
          id
          name
          board {
            id
            name
          }
          group {
            id
            title
          }
          column_values {
            id
            title
            type
            text
            value
          }
        }
      }
    `;

    const data = await this.executeGraphQL<{ items: MondayItem[] }>(query, { itemId: [itemId] }, token);
    return data?.items?.[0] || null;
  }

  /**
   * Create an update (comment/pulse update) on an item (used for 1-Click Nudge and SLA alerts)
   */
  async createUpdate(itemId: string, bodyText: string, token?: string): Promise<{ id: string }> {
    const mutation = `
      mutation CreateItemUpdate($itemId: ID!, $body: String!) {
        create_update(item_id: $itemId, body: $body) {
          id
        }
      }
    `;

    const data = await this.executeGraphQL<{ create_update: { id: string } }>(
      mutation,
      { itemId, body: bodyText },
      token
    );
    return data.create_update;
  }

  /**
   * Change status column value on an item (e.g. for SLA escalation: "Critical")
   */
  async changeStatus(
    boardId: string,
    itemId: string,
    columnId: string,
    label: string,
    token?: string
  ): Promise<{ id: string }> {
    const mutation = `
      mutation ChangeStatus($itemId: ID!, $boardId: ID!, $columnId: String!, $value: String!) {
        change_simple_column_value(item_id: $itemId, board_id: $boardId, column_id: $columnId, value: $value) {
          id
        }
      }
    `;

    const data = await this.executeGraphQL<{ change_simple_column_value: { id: string } }>(
      mutation,
      { itemId, boardId, columnId, value: label },
      token
    );
    return data.change_simple_column_value;
  }

  /**
   * Move an item to a different group (e.g. "Urgent")
   */
  async moveItemToGroup(itemId: string, groupId: string, token?: string): Promise<{ id: string }> {
    const mutation = `
      mutation MoveItem($itemId: ID!, $groupId: String!) {
        move_item_to_group(item_id: $itemId, group_id: $groupId) {
          id
        }
      }
    `;

    const data = await this.executeGraphQL<{ move_item_to_group: { id: string } }>(
      mutation,
      { itemId, groupId },
      token
    );
    return data.move_item_to_group;
  }

  /**
   * Get board structure, groups, and columns
   */
  async getBoardDetails(boardId: string, token?: string): Promise<any> {
    const query = `
      query GetBoardDetails($boardId: [ID!]) {
        boards(ids: $boardId) {
          id
          name
          groups {
            id
            title
          }
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `;

    const data = await this.executeGraphQL<{ boards: any[] }>(query, { boardId: [boardId] }, token);
    return data?.boards?.[0] || null;
  }

  /**
   * Fallback mock responses when working in local test environment without live credentials
   */
  private mockGraphQLResponse(query: string, variables: Record<string, any>): any {
    if (query.includes('create_update')) {
      return { create_update: { id: `mock-update-${Date.now()}` } };
    }
    if (query.includes('change_simple_column_value')) {
      return { change_simple_column_value: { id: String(variables.itemId || 'mock-item') } };
    }
    if (query.includes('move_item_to_group')) {
      return { move_item_to_group: { id: String(variables.itemId || 'mock-item') } };
    }
    if (query.includes('GetItemDetails')) {
      const itemId = Array.isArray(variables.itemId) ? variables.itemId[0] : 'mock-item-1';
      return {
        items: [
          {
            id: String(itemId),
            name: `Item #${itemId}`,
            board: { id: '12345678', name: 'Product Roadmap' },
            group: { id: 'group_tasks', title: 'Sprint Backlog' },
            column_values: [
              { id: 'status', title: 'Status', type: 'color', text: 'Working on it', value: '{"index":1}' },
              { id: 'person', title: 'Owner', type: 'multiple-person', text: 'Alex ProjectManager', value: '{"personsAndTeams":[{"id":1001,"kind":"person"}]}' },
            ],
          },
        ],
      };
    }
    if (query.includes('GetBoardDetails')) {
      return {
        boards: [
          {
            id: String(variables.boardId || '12345678'),
            name: 'Main Workflow Board',
            groups: [
              { id: 'topics', title: 'Active Tasks' },
              { id: 'urgent_group', title: 'Urgent' },
            ],
            columns: [
              { id: 'status', title: 'Status', type: 'color', settings_str: '{"labels":{"0":"Working on it","1":"Done","2":"Stuck","3":"In Review"}}' },
              { id: 'person', title: 'Assignee', type: 'multiple-person', settings_str: '{}' },
              { id: 'time_tracking', title: 'Time Tracking', type: 'duration', settings_str: '{}' },
            ],
          },
        ],
      };
    }
    return {};
  }
}

export const mondayService = new MondayService();
export default mondayService;
