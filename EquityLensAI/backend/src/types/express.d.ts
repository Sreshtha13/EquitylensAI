declare namespace Express {
  interface Request {
    requestId: string;
    user?:
      | {
          id: string;
          email: string;
          role?: string | undefined;
        }
      | undefined;
  }
}
