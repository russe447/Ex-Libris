import { AiRequestError } from '@/services/anthropic';

/**
 * Turn any thrown value into one sentence an author can act on.
 *
 * The server already classifies its own failures; this adds the case the
 * server can't report — it being down itself.
 */
export function describeAiFailure(error: unknown): string {
  if (error instanceof AiRequestError) {
    return error.hint ? `${error.message} ${error.hint}` : error.message;
  }
  if (error instanceof TypeError) {
    return 'Could not reach the Ex Libris server. Is it running? Try `npm run dev:server`.';
  }
  return error instanceof Error && error.message
    ? error.message
    : 'Something went wrong talking to the AI provider.';
}
