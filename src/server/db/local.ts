import Database from 'better-sqlite3'
import pathlib from 'path'
import fs from 'fs'

const DATA_DIR = pathlib.resolve(process.cwd(), 'data')
const DB_PATH = pathlib.resolve(DATA_DIR, 'local.db')

let db: Database.Database | null = null

export function getLocalDB(): Database.Database {
  if (db) return db
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  initTables(db)
  return db
}

function initTables(db: Database.Database) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    _id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT, is_super INTEGER, is_active INTEGER,
    allowed_device TEXT, per_sim_limit INTEGER, max_devices INTEGER, expires_at TEXT, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS firebases (
    _id TEXT PRIMARY KEY, id TEXT, name TEXT, database_url TEXT, service_account_json TEXT, status TEXT, device_count INTEGER, online_count INTEGER, last_polled_at TEXT, last_tested_at TEXT, created_at TEXT, owner_id TEXT
  );
  CREATE TABLE IF NOT EXISTS devices (
    _id TEXT PRIMARY KEY, id TEXT, firebase_id TEXT, name TEXT, model TEXT, status TEXT, battery INTEGER, signal INTEGER, last_seen TEXT, total_sent INTEGER, total_failed INTEGER, extra TEXT, created_at TEXT, sim_count INTEGER, has_recharge INTEGER, sim1_recharge INTEGER, sim2_recharge INTEGER, validated_score INTEGER, validated_at TEXT, validator_fail_count INTEGER, owner_id TEXT
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    _id TEXT PRIMARY KEY, id TEXT, name TEXT, template TEXT, status TEXT, total INTEGER, sent INTEGER, failed INTEGER, pending INTEGER, created_at TEXT, started_at TEXT, finished_at TEXT, owner_id TEXT, batch_size INTEGER, delay_ms INTEGER
  );
  CREATE TABLE IF NOT EXISTS campaign_messages (
    _id TEXT PRIMARY KEY, id TEXT, campaign_id TEXT, phone TEXT, variables TEXT, rendered TEXT, status TEXT, device_id TEXT, firebase_id TEXT, attempts INTEGER, last_error TEXT, sent_at TEXT, created_at TEXT, owner_id TEXT
  );
  CREATE TABLE IF NOT EXISTS queue_items (
    _id TEXT PRIMARY KEY, id TEXT, campaign_id TEXT, message_id TEXT, priority INTEGER, status TEXT, created_at TEXT, owner_id TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    _id TEXT PRIMARY KEY, key TEXT, value TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    _id TEXT PRIMARY KEY, user_id TEXT, ip TEXT, device_id TEXT, token TEXT, last_active TEXT
  );
  CREATE TABLE IF NOT EXISTS device_daily_stats (
    _id TEXT PRIMARY KEY, device_id TEXT, owner_id TEXT, firebase_id TEXT, date TEXT, count INTEGER, updated_at TEXT,
    UNIQUE(device_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
  CREATE INDEX IF NOT EXISTS idx_devices_firebase ON devices(firebase_id);
  CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);
  CREATE INDEX IF NOT EXISTS idx_firebases_owner ON firebases(owner_id);
  CREATE INDEX IF NOT EXISTS idx_campaigns_owner ON campaigns(owner_id);
  `)
  console.log('[LocalDB] tables ready', DB_PATH)
}

export async function initLocalDB() {
  getLocalDB()
}

// ---------- helper: convert row <-> doc ----------
function rowToDoc(row:any): any {
  if (!row) return null
  const doc = { ...row }
  // keep _id as string, also add id if missing
  if (!doc.id && doc._id) doc.id = doc._id
  return doc
}

// Very small query matcher for local - supports: direct eq, { $in: [] }, { $nin: [] }, { $ne: val }, { $exists: true/false }, { $gte, $lte }, { $regex }, { $or: [] }
function matches(doc:any, filter:any): boolean {
  if (!filter || Object.keys(filter).length===0) return true
  for (const [k,v] of Object.entries(filter as any)) {
    if (k==='$or') {
      const arr=v as any[]
      if (!arr.some(f=> matches(doc,f))) return false
      continue
    }
    if (k==='$and') {
      const arr=v as any[]
      if (!arr.every(f=> matches(doc,f))) return false
      continue
    }
    const docVal=(doc as any)[k]
    if (v && typeof v==='object' && !Array.isArray(v)) {
      const cond=v as any
      if ('$in' in cond) {
        if (!cond.$in.includes(docVal)) return false
      } else if ('$nin' in cond) {
        if (cond.$nin.includes(docVal)) return false
      } else if ('$ne' in cond) {
        if (docVal===cond.$ne) return false
      } else if ('$exists' in cond) {
        const exists = docVal!==undefined && docVal!==null && docVal!==''
        if (cond.$exists && !exists) return false
        if (!cond.$exists && exists) return false
      } else if ('$gte' in cond) {
        if ((docVal||'') < cond.$gte) return false
      } else if ('$lte' in cond) {
        if ((docVal||'') > cond.$lte) return false
      } else if ('$gt' in cond) {
        if ((docVal||'') <= cond.$gt) return false
      } else if ('$lt' in cond) {
        if ((docVal||'') >= cond.$lt) return false
      } else if ('$regex' in cond) {
        const re=new RegExp(cond.$regex, cond.$options||'')
        if (!re.test(String(docVal||''))) return false
      } else if ('$eq' in cond) {
        if (docVal!==cond.$eq) return false
      } else {
        // unknown operator, fallback to eq
        if (docVal!==v) return false
      }
    } else {
      if (docVal!==v) return false
    }
  }
  return true
}

function applyUpdate(doc:any, update:any): any {
  const out={...doc}
  if (update.$set) {
    for (const [k,v] of Object.entries(update.$set)) (out as any)[k]=v
  }
  if (update.$inc) {
    for (const [k,v] of Object.entries(update.$inc as any)) (out as any)[k]=((out as any)[k]||0)+(v as number)
  }
  if (update.$setOnInsert) {
    // only if doc didn't exist, caller handles
  }
  // direct replace if no $ operator
  if (!update.$set && !update.$inc && !update.$setOnInsert) {
    Object.assign(out, update)
  }
  return out
}

// ---------- LocalCollection ----------
class LocalCollection {
  name:string
  table:string
  constructor(name:string, table:string){ this.name=name; this.table=table }

  private allRows(): any[] {
    const db=getLocalDB()
    return db.prepare(`SELECT * FROM ${this.table}`).all() as any[]
  }

  async find(filter:any={}, opts?:any): Promise<any> {
    let rows=this.allRows().filter(d=> matches(d, filter))
    // sort
    if (opts?.sort) {
      const [field, dir]=Object.entries(opts.sort as any)[0] as any
      rows.sort((a,b)=>{
        const av=a[field]||''; const bv=b[field]||''
        if (av < bv) return dir===-1?1:-1
        if (av > bv) return dir===-1?-1:1
        return 0
      })
    }
    // lean mock
    const chain = {
      _rows: rows,
      _limit: Infinity as number,
      lean() { return this },
      sort(s:any){
        const [field, dir]=Object.entries(s as any)[0] as any
        this._rows.sort((a:any,b:any)=>{
          const av=a[field]||''; const bv=b[field]||''
          if (av < bv) return dir===-1?1:-1
          if (av > bv) return dir===-1?-1:1
          return 0
        })
        return this
      },
      limit(n:number){ this._limit=n; return this },
      exec(){ return Promise.resolve(this._rows.slice(0,this._limit).map(rowToDoc)) },
      then(resolve:any, reject:any){
        const out=this._rows.slice(0,this._limit).map(rowToDoc)
        return Promise.resolve(out).then(resolve, reject)
      }
    } as any
    // also make it thenable for await
    // @ts-ignore
    chain[Symbol.asyncIterator]=undefined
    // For direct await: return array-like thenable
    return chain
  }

  // for simple use: await Model.find(filter).lean()
  // we need to make find return a thenable that resolves to array
  // So we override to return a Promise-like object
  // Simpler: handle two calling styles: with and without .lean()
  // We'll make find return an object with then and lean etc., but also make it awaitable
  // Instead, implement find as returning a Query object that is thenable

  async findOne(filter:any): Promise<any> {
    const rows=this.allRows().filter(d=> matches(d, filter))
    const doc=rows[0] ? rowToDoc(rows[0]) : null
    return {
      lean: () => Promise.resolve(doc),
      then: (res:any, rej:any)=> Promise.resolve(doc).then(res, rej)
    } as any
  }

  async findOneLean(filter:any): Promise<any> {
    const rows=this.allRows().filter(d=> matches(d, filter))
    return rows[0] ? rowToDoc(rows[0]) : null
  }

  async create(doc:any): Promise<any> {
    const db=getLocalDB()
    const cols=Object.keys(doc)
    const placeholders=cols.map(()=>'?').join(',')
    const sql=`INSERT OR REPLACE INTO ${this.table} (${cols.join(',')}) VALUES (${placeholders})`
    db.prepare(sql).run(...cols.map(c=> (doc as any)[c]))
    return rowToDoc(doc)
  }

  async insertMany(docs:any[], opts?:any): Promise<any> {
    const db=getLocalDB()
    const tx=db.transaction((docs:any[])=>{
      for(const doc of docs){
        const cols=Object.keys(doc)
        const placeholders=cols.map(()=>'?').join(',')
        const sql=`INSERT OR REPLACE INTO ${this.table} (${cols.join(',')}) VALUES (${placeholders})`
        db.prepare(sql).run(...cols.map(c=> (doc as any)[c]))
      }
    })
    tx(docs)
    return docs
  }

  async updateOne(filter:any, update:any, opts?:any): Promise<any> {
    const db=getLocalDB()
    const rows=this.allRows().filter(d=> matches(d, filter))
    if (rows.length===0) {
      if (opts?.upsert) {
        let base={...filter}
        // handle $setOnInsert
        const newDoc={...base}
        if (update.$set) Object.assign(newDoc, update.$set)
        if (update.$setOnInsert) Object.assign(newDoc, update.$setOnInsert)
        if (update.$inc) for(const [k,v] of Object.entries(update.$inc as any)) (newDoc as any)[k]=((newDoc as any)[k]||0)+(v as number)
        // ensure _id
        if (!newDoc._id && newDoc.id) newDoc._id=newDoc.id
        const cols=Object.keys(newDoc)
        const placeholders=cols.map(()=>'?').join(',')
        db.prepare(`INSERT OR REPLACE INTO ${this.table} (${cols.join(',')}) VALUES (${placeholders})`).run(...cols.map(c=> (newDoc as any)[c]))
        return { modifiedCount:0, upsertedCount:1, matchedCount:0 }
      }
      return { modifiedCount:0, matchedCount:0 }
    }
    const doc=rows[0]
    let updated=applyUpdate(doc, update)
    // handle $setOnInsert not applicable
    const cols=Object.keys(updated)
    const setClause=cols.filter(c=>c!=='_id').map(c=> `${c}=?`).join(',')
    const values=cols.filter(c=>c!=='_id').map(c=> (updated as any)[c])
    values.push(doc._id)
    db.prepare(`UPDATE ${this.table} SET ${setClause} WHERE _id=?`).run(...values)
    return { modifiedCount:1, matchedCount:1 }
  }

  async updateMany(filter:any, update:any): Promise<any> {
    const rows=this.allRows().filter(d=> matches(d, filter))
    const db=getLocalDB()
    let count=0
    const tx=db.transaction((rows:any[])=>{
      for(const doc of rows){
        const updated=applyUpdate(doc, update)
        const cols=Object.keys(updated)
        const setClause=cols.filter(c=>c!=='_id').map(c=> `${c}=?`).join(',')
        const values=cols.filter(c=>c!=='_id').map(c=> (updated as any)[c])
        values.push(doc._id)
        db.prepare(`UPDATE ${this.table} SET ${setClause} WHERE _id=?`).run(...values)
        count++
      }
    })
    tx(rows)
    return { modifiedCount:count, matchedCount:rows.length }
  }

  async deleteOne(filter:any): Promise<any> {
    const db=getLocalDB()
    const rows=this.allRows().filter(d=> matches(d, filter))
    if (rows.length) db.prepare(`DELETE FROM ${this.table} WHERE _id=?`).run(rows[0]._id)
    return { deletedCount: rows.length?1:0 }
  }

  async deleteMany(filter:any): Promise<any> {
    const rows=this.allRows().filter(d=> matches(d, filter))
    const db=getLocalDB()
    const tx=db.transaction((rows:any[])=>{
      for(const r of rows) db.prepare(`DELETE FROM ${this.table} WHERE _id=?`).run(r._id)
    })
    tx(rows)
    return { deletedCount: rows.length }
  }

  async countDocuments(filter:any={}): Promise<number> {
    return this.allRows().filter(d=> matches(d, filter)).length
  }

  async distinct(field:string, filter:any={}): Promise<any[]> {
    const rows=this.allRows().filter(d=> matches(d, filter))
    return [...new Set(rows.map(r=> r[field]))]
  }

  async bulkWrite(ops:any[], opts?:any): Promise<any> {
    const db=getLocalDB()
    let inserted=0, matched=0, modified=0, upserted=0
    const tx=db.transaction((ops:any[])=>{
      for(const op of ops){
        if (op.updateOne) {
          const {filter, update, upsert} = op.updateOne
          const rows=this.allRows().filter(d=> matches(d, filter))
          if (rows.length===0 && upsert) {
            let base={...filter}
            const newDoc:any={...base}
            if (update.$set) Object.assign(newDoc, update.$set)
            if (update.$setOnInsert) Object.assign(newDoc, update.$setOnInsert)
            if (update.$inc) for(const [k,v] of Object.entries(update.$inc as any)) newDoc[k]= (newDoc[k]||0)+(v as number)
            if (!newDoc._id && newDoc.id) newDoc._id=newDoc.id
            const cols=Object.keys(newDoc)
            db.prepare(`INSERT OR REPLACE INTO ${this.table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...cols.map(c=> newDoc[c]))
            upserted++; inserted++
          } else if (rows.length) {
            const doc=rows[0]
            const updated=applyUpdate(doc, update)
            const cols=Object.keys(updated)
            const setClause=cols.filter(c=>c!=='_id').map(c=> `${c}=?`).join(',')
            const values=cols.filter(c=>c!=='_id').map(c=> updated[c])
            values.push(doc._id)
            db.prepare(`UPDATE ${this.table} SET ${setClause} WHERE _id=?`).run(...values)
            matched++; modified++
          }
        } else if (op.insertOne) {
          const doc=op.insertOne.document
          const cols=Object.keys(doc)
          db.prepare(`INSERT OR REPLACE INTO ${this.table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...cols.map(c=> doc[c]))
          inserted++
        } else if (op.deleteOne) {
          const rows=this.allRows().filter(d=> matches(d, op.deleteOne.filter))
          if (rows.length) db.prepare(`DELETE FROM ${this.table} WHERE _id=?`).run(rows[0]._id)
        }
      }
    })
    tx(ops)
    return { insertedCount: inserted, matchedCount: matched, modifiedCount: modified, upsertedCount: upserted, deletedCount:0 }
  }

  async aggregate(pipeline:any[]): Promise<any[]> {
    // very limited aggregate for our stats: supports $match, $group, $sort, $limit, $lookup, $unwind, $project, $substr
    let rows=this.allRows()
    for(const stage of pipeline){
      if (stage.$match) {
        rows=rows.filter(d=> matches(d, stage.$match))
      } else if (stage.$group) {
        const g=stage.$group
        // only handle _id: null or _id: '$field' and sums
        if (g._id===null) {
          const out:any={_id:null}
          for(const [k,v] of Object.entries(g as any)){
            if (k==='_id') continue
            const val=v as any
            if (val.$sum!==undefined) {
              if (typeof val.$sum==='number') {
                if (val.$sum===1) out[k]=rows.length
                else out[k]=rows.length*val.$sum
              } else if (val.$sum==='$count') {
                out[k]=rows.reduce((a,r)=> a+(r.count||0),0)
              } else if (typeof val.$sum==='object' && val.$sum.$cond) {
                const cond=val.$sum.$cond
                let sum=0
                for(const r of rows){
                  // cond: [ {$eq: [...]}, 1, 0 ] or [$and: [...]]
                  let res=0
                  const test=cond[0]
                  let ok=false
                  if (test.$eq) {
                    const [a,b]=test.$eq
                    const av= typeof a==='string' && a.startsWith('$') ? r[a.slice(1)] : a
                    const bv= typeof b==='string' && b.startsWith('$') ? r[b.slice(1)] : b
                    ok = av===bv
                  } else if (test.$and) {
                    ok=test.$and.every((c:any)=>{
                      if (c.$eq) {
                        const [a,b]=c.$eq
                        const av= typeof a==='string' && a.startsWith('$') ? r[a.slice(1)] : a
                        const bv= typeof b==='string' && b.startsWith('$') ? r[b.slice(1)] : b
                        return av===bv
                      }
                      return false
                    })
                  }
                  if (ok) res=cond[1]; else res=cond[2]
                  sum+=res
                }
                out[k]=sum
              } else if (val.$sum.$addToSet) {
                // not needed
                out[k]=0
              }
            }
          }
          rows=[out]
        } else {
          // group by field
          const idExpr=g._id
          const groups=new Map<any, any>()
          for(const r of rows){
            let key:any
            if (typeof idExpr==='string' && idExpr.startsWith('$')) key=r[idExpr.slice(1)]
            else if (typeof idExpr==='object') {
              // {device_id:'$device_id', owner_id:'$owner_id'} etc.
              key=JSON.stringify(Object.fromEntries(Object.entries(idExpr).map(([k,v]:any)=> [k, typeof v==='string' && v.startsWith('$') ? r[v.slice(1)] : v])))
            } else key=idExpr
            if (!groups.has(key)) {
              const init:any={_id: typeof idExpr==='string' && idExpr.startsWith('$')? key : (typeof idExpr==='object'? JSON.parse(key): key)}
              for(const [k,v] of Object.entries(g as any)){
                if (k==='_id') continue
                init[k]=0
              }
              groups.set(key, init)
            }
            const out=groups.get(key)
            for(const [k,v] of Object.entries(g as any)){
              if (k==='_id') continue
              const val=v as any
              if (val.$sum!==undefined) {
                if (val.$sum===1) out[k]+=1
                else if (typeof val.$sum==='number') out[k]+=val.$sum
                else if (val.$sum==='$count') out[k]+=r.count||0
                else if (val.$sum.$cond) {
                  // simplified
                  const cond=val.$sum.$cond
                  const test=cond[0]
                  let ok=false
                  if (test.$eq) {
                    const [a,b]=test.$eq
                    const av= typeof a==='string' && a.startsWith('$') ? r[a.slice(1)] : a
                    const bv= typeof b==='string' && b.startsWith('$') ? r[b.slice(1)] : b
                    ok = av===bv
                  }
                  if (ok) out[k]+=cond[1]; else out[k]+=cond[2]
                }
              }
            }
          }
          rows=Array.from(groups.values())
        }
      } else if (stage.$sort) {
        const [field, dir]=Object.entries(stage.$sort as any)[0] as any
        rows.sort((a:any,b:any)=> {
          const av=a[field]||0; const bv=b[field]||0
          if (av < bv) return dir===-1?1:-1
          if (av > bv) return dir===-1?-1:1
          return 0
        })
      } else if (stage.$limit) {
        rows=rows.slice(0, stage.$limit)
      } else if (stage.$lookup) {
        // not implemented fully for local, return without
        // for stats we can skip lookup
      } else if (stage.$unwind) {
        // no-op
      } else if (stage.$project) {
        // no-op keep
      }
    }
    return rows
  }

  // for compatibility: allow find().lean() etc. - we handle via wrapper
  // Also support syncIndexes
  async syncIndexes(){ return }
}

// Export collections
const collections:Record<string, LocalCollection> = {
  users: new LocalCollection('users','users'),
  firebases: new LocalCollection('firebases','firebases'),
  devices: new LocalCollection('devices','devices'),
  campaigns: new LocalCollection('campaigns','campaigns'),
  campaign_messages: new LocalCollection('campaign_messages','campaign_messages'),
  queue_items: new LocalCollection('queue_items','queue_items'),
  settings: new LocalCollection('settings','settings'),
  sessions: new LocalCollection('sessions','sessions'),
  device_daily_stats: new LocalCollection('device_daily_stats','device_daily_stats'),
}

function wrapCollection(col: LocalCollection){
  // create a proxy that makes find return thenable query
  const handler:any = {
    get(target:any, prop:string){
      if (prop==='find') {
        return (filter:any, proj?:any)=>{
          const q = {
            _filter: filter,
            _sort: null as any,
            _limit: null as any,
            sort(s:any){ this._sort=s; return this },
            limit(n:number){ this._limit=n; return this },
            lean(){ return this },
            exec: async ()=>{
              let rows= (col as any).allRows().filter((d:any)=> matches(d, filter))
              if (q._sort) {
                const [field, dir]=Object.entries(q._sort as any)[0] as any
                rows.sort((a:any,b:any)=>{
                  const av=a[field]||''; const bv=b[field]||''
                  if (av < bv) return dir===-1?1:-1
                  if (av > bv) return dir===-1?-1:1
                  return 0
                })
              }
              if (q._limit!==null) rows=rows.slice(0,q._limit)
              return rows.map(rowToDoc)
            },
            then(resolve:any, reject:any){
              return this.exec().then(resolve, reject)
            },
            // make await work
            [Symbol.toStringTag]: 'Query'
          }
          // make it thenable
          return q
        }
      }
      if (prop==='findOne') {
        return (filter:any)=>{
          const p = {
            lean: async ()=>{
              const rows=(col as any).allRows().filter((d:any)=> matches(d, filter))
              return rows[0] ? rowToDoc(rows[0]) : null
            },
            exec: async ()=>{
              const rows=(col as any).allRows().filter((d:any)=> matches(d, filter))
              return rows[0] ? rowToDoc(rows[0]) : null
            },
            then(resolve:any, reject:any){
              const rows=(col as any).allRows().filter((d:any)=> matches(d, filter))
              const doc=rows[0] ? rowToDoc(rows[0]) : null
              return Promise.resolve(doc).then(resolve, reject)
            }
          }
          return p
        }
      }
      // direct methods
      const val=(target as any)[prop]
      if (typeof val==='function') return val.bind(target)
      return val
    }
  }
  return new Proxy(col, handler)
}

export function getLocalModels(){
  return {
    User: wrapCollection(collections.users) as any,
    Firebase: wrapCollection(collections.firebases) as any,
    Device: wrapCollection(collections.devices) as any,
    Campaign: wrapCollection(collections.campaigns) as any,
    CampaignMessage: wrapCollection(collections.campaign_messages) as any,
    QueueItem: wrapCollection(collections.queue_items) as any,
    Setting: wrapCollection(collections.settings) as any,
    Session: wrapCollection(collections.sessions) as any,
    DeviceDailyStat: wrapCollection(collections.device_daily_stats) as any,
  }
}
