import type { APIRoute } from 'astro';
import { getGlossary } from '../../utils/glossary';

export const GET: APIRoute = async () => {
  const glossary = await getGlossary();
  return new Response(JSON.stringify(glossary), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
};
