export const NextResponse = {
  json(data: unknown, init?: ResponseInit) {
    return Response.json(data, init);
  },
};
