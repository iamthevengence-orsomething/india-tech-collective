import { loadArtifact } from '../../lib/data';

export function GET() {
  return new Response(JSON.stringify(loadArtifact('sources')), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
