export class Session {
  unimplementedSession = true;
  static everyone = new Session();
  static internalPrivileged = new Session();
}
