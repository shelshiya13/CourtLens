import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface Statement<T = any> {
  run(...params: any[]): RunResult;
  get(...params: any[]): T | undefined;
  all(...params: any[]): T[];
}

export interface DatabaseClient {
  prepare<T = any>(sql: string): Statement<T>;
  exec(sql: string): void;
  transaction<T>(fn: () => T): () => T;
  close(): void;
  save(): void;
  rawDb: SqlJsDatabase;
}

let dbInstance: DatabaseClient | null = null;

function normalizeParams(params: any[]): any[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export async function getDb(customPath?: string): Promise<DatabaseClient> {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const SQL = await initSqlJs();
  const dbDir = path.resolve(process.env.DATA_DIR || './data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbFile = customPath || path.join(dbDir, 'caselens.db');
  let rawDb: SqlJsDatabase;

  if (fs.existsSync(dbFile)) {
    const fileBuffer = fs.readFileSync(dbFile);
    rawDb = new SQL.Database(fileBuffer);
  } else {
    rawDb = new SQL.Database();
  }

  rawDb.run('PRAGMA foreign_keys = ON;');

  const saveToDisk = () => {
    try {
      const data = rawDb.export();
      const buffer = Buffer.from(data);
      const tmpFile = `${dbFile}.tmp`;
      fs.writeFileSync(tmpFile, buffer);
      fs.renameSync(tmpFile, dbFile);
    } catch (err) {
      console.error('Failed to save database to disk:', err);
    }
  };

  const client: DatabaseClient = {
    rawDb,
    save: saveToDisk,
    prepare<T = any>(sql: string): Statement<T> {
      return {
        run(...params: any[]): RunResult {
          const flat = normalizeParams(params);
          rawDb.run(sql, flat);
          saveToDisk();
          
          let changes = 0;
          try {
            const res = rawDb.exec('SELECT changes() as c, last_insert_rowid() as id');
            if (res[0] && res[0].values[0]) {
              changes = Number(res[0].values[0][0]) || 0;
              const lastId = Number(res[0].values[0][1]) || 0;
              return { changes, lastInsertRowid: lastId };
            }
          } catch {
            // ignore
          }
          return { changes, lastInsertRowid: 0 };
        },
        get(...params: any[]): T | undefined {
          const flat = normalizeParams(params);
          const stmt = rawDb.prepare(sql);
          stmt.bind(flat);
          if (stmt.step()) {
            const row = stmt.getAsObject() as T;
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params: any[]): T[] {
          const flat = normalizeParams(params);
          const stmt = rawDb.prepare(sql);
          stmt.bind(flat);
          const results: T[] = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject() as T);
          }
          stmt.free();
          return results;
        }
      };
    },
    exec(sql: string) {
      rawDb.run(sql);
      saveToDisk();
    },
    transaction<T>(fn: () => T): () => T {
      return () => {
        rawDb.run('BEGIN TRANSACTION;');
        try {
          const result = fn();
          rawDb.run('COMMIT;');
          saveToDisk();
          return result;
        } catch (err) {
          rawDb.run('ROLLBACK;');
          throw err;
        }
      };
    },
    close() {
      saveToDisk();
      rawDb.close();
      if (dbInstance === client) {
        dbInstance = null;
      }
    }
  };

  if (!customPath) {
    dbInstance = client;
  }
  return client;
}
