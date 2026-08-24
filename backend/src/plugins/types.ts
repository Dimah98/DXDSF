import { NodeHandler } from '../nodes/types';

/**
 * Interface for a domain-specific plugin that registers custom node handlers.
 */
export interface BotPlugin {
  /** Unique plugin identifier */
  name: string;

  /** Human-readable plugin description */
  description: string;

  /** Node handlers provided by this plugin */
  nodeHandlers: Record<string, NodeHandler>;
}
