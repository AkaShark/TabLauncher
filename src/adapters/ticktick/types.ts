/**
 * TickTick Open API raw shapes + our normalized internal task type.
 * Status codes (TickTick): 0 = normal, 1 = completed, 2 = archived (some tools)
 *   — research §3.x. We treat anything != 0 as "not pending".
 */

export interface TickTickProject {
  id: string;
  name: string;
  color?: string;
  closed?: boolean | null;
  groupId?: string | null;
  viewMode?: string | null;
  permission?: string | null;
  kind?: string | null;
}

export interface TickTickTask {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  status: number;
  priority?: number;
  dueDate?: string | null;
  startDate?: string | null;
  isAllDay?: boolean;
  timeZone?: string;
  completedTime?: string | null;
  modifiedTime?: string | null;
  createdTime?: string | null;
  tags?: string[];
}

export interface TickTickProjectData {
  project: TickTickProject;
  tasks: TickTickTask[];
}

/** Internal app shape — UI/store/persistence layer talks in this. */
export interface NormalizedTask {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  /** Free-form notes (Markdown-ish). TickTick's `content` field. */
  content: string;
  /** Short subtitle. TickTick's `desc` field. */
  desc: string;
  /** ISO strings (server-side). */
  startDate: string | null;
  dueDate: string | null;
  modifiedTime: string | null;
  createdTime: string | null;
  isAllDay: boolean;
  tags: string[];
  priority: number;
  /** true if TickTick status === 1 (completed) */
  completed: boolean;
  url: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}
