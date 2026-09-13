// A first visit without an active worker cannot receive a local share.
// Do not parse, persist, or forward the submitted photograph.
export async function POST(request: Request) {
  return Response.redirect(new URL('/?share=unavailable', request.url), 303);
}
