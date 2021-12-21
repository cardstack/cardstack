declare module 'pg-cursor' {
  export default class Cursor {
    constructor(sql: string, params: any[]);
    read(length: number, cb: (err: any, rows: Record<string, any>[]) => void);
  }
}
