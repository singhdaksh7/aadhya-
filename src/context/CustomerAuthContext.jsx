import { createContext,useCallback,useContext,useEffect,useRef,useState } from "react";
import { customerLogin,customerLogout,customerRefresh,customerRegister,setAccessToken } from "../lib/api";
const Context=createContext({ user: null, status: "unauthenticated", login: async () => {}, register: async () => {}, logout: async () => {}, updateUser: () => {} });
export function CustomerAuthProvider({children}){const [user,setUser]=useState(null),[status,setStatus]=useState("loading");const bootstrapped=useRef(false);const authVersion=useRef(0);useEffect(()=>{
  // The customer refresh token is single-use (rotated on every call), so
  // React 18/19 StrictMode's dev-only double-invocation of this effect would
  // otherwise fire two concurrent /refresh requests against the same
  // pre-rotation cookie: one succeeds, the other 401s on the now-revoked
  // token, and depending on which settles last the user can be dropped back
  // to "unauthenticated" despite holding a perfectly valid session. Guard so
  // the real network call only ever fires once per mount.
  if(bootstrapped.current)return;bootstrapped.current=true;const version=authVersion.current;
  customerRefresh().then(r=>{if(version!==authVersion.current)return;setAccessToken(r.data.accessToken);setUser(r.data.customer);setStatus("authenticated")}).catch(()=>{if(version!==authVersion.current)return;setAccessToken(null);setUser(null);setStatus("unauthenticated")})},[]);const signIn=useCallback(async(data,register=false)=>{authVersion.current+=1;const r=await (register?customerRegister(data):customerLogin(data));setAccessToken(r.data.accessToken);setUser(r.data.customer);setStatus("authenticated");return r.data.customer},[]);const updateUser=useCallback((changes)=>setUser(current=>current?{...current,...changes}:current),[]);const logout=useCallback(async()=>{authVersion.current+=1;try{await customerLogout()}finally{setAccessToken(null);setUser(null);setStatus("unauthenticated")}},[]);return <Context.Provider value={{user,status,login:d=>signIn(d),register:d=>signIn(d,true),logout,updateUser}}>{children}</Context.Provider>}
export function useCustomerAuth(){return useContext(Context)}
