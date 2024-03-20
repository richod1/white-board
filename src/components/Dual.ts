import {
    InstancePresenceRecordType,
    TLInstancePresence,
    TLAnyShapeUtilConstructor,
    TLStoreWithStatus,
    computed,
    createPresenceStateDerivation,
    TLRecord,
    createTLStore,
    defaultShapeUtils,
    getUserPreferences,
    setUserPreferences,
    react,
    compareSchemas,
    SerializedSchemas

} from "@tldraw/tldraw"
import {useEffect,useMemo,useState} from 'react'
import { YKeyValue } from "y-utility/y-keyvalue"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

export function useYjsStore({roomId='example',hostUrl=import.meta.env.NODE==='development'?'ws://localhost:1234'
:'ws://demos.yjs.dev',shapeUtils=[],}:Partial<{
    hostId:string
    roomId:string
    version:number
    shapeUtils:TLAnyShapeUtilConstructor[]
}>){
    const [store]=useState(()=>{
        const store=createTLStore({
            shapeUtils:[...defaultShapeUtils,...shapeUtils]
        })

        return store;
    })

    const [storeWithStatus,setStoreWithStatus]=useState<TLStoreWithStatus>({
        status:'loading',

    })

    const {yDoc,yStore,meta,room}=useMemo(()=>{
        const yDoc=new Y.Doc({gc:true})
        const yArr=yDoc.getArray<{key:string;val:TLRecord}>(`tl_${roomId}`)
        const yStore=new YKeyValue(yArr)
        const meta=yDoc.getMap<SerializedSchemas>(`meta`)

        return {
            yDoc,
            yStore,
            meta,
            room:new WebsocketProvider(hostUrl,roomId,yDoc,{connect:true})
        }
    },[hostUrl,roomId])
    useEffect(()=>{
        setStoreWithStatus({status:'loading'})

        const unsubs:(()=>void)[]=[];

        function handleSync(){
            unsubs.push(
                store.listen(
                    function syncStoreChangeToYjsDoc({changes}){
                        yDoc.transact(()=>{
                            Object.values(changes.added).forEach((record)=>{
                                yStore.set(record.id,record)
                            })
                            Object.values(changes.updated).forEach(([_,record])=>{
                                yStore.set(record.id,record)
                            })
                            Object.values(changes.removed).forEach((record)=>{
                                yStore.delete(record.id)
                            })
                        })
                    },
                    {source:'user',scope:'document'}
                )
            )

            const handleChange=(
                changes:Map<
                string,|{action:'delete';oldValue:TLRecord}
                |{action:'update';oldValue:TLRecord,newValue:TLRecord}
                |{acrion:'add';newValue:TLRecord}
                >,
                transaction:Y.Transaction,
            )=>{
                if(transaction.local) return

                const toRemove:TLRecord['id'][]=[]
                const toPut:TLRecord[]=[]

                changes.forEach((change,id)=>{
                    switch(change.action){
                        case 'add':
                            case 'update':{
                                const record=yStore.get(id)!
                                toPut.push(record)
                                break
                            }

                            case 'delete':{
                                toRemove.push(id as TLRecord['id'])
                                break
                            }
                    }
                })

                store.mergeRemoteChanges(()=>{
                    if(toRemove.length) store.remove(toRemove)
                    if(toPut.length) store.put(toPut)
                })
            }
            yStore.on('change',handleChange)
            unsubs.push(()=>yStore.off('change',handleChange))

            const yClientId=room.
        }
    },[])
}
