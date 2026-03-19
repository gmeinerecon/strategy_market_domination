
// FULLY CONNECTED FRONTEND WITH WEBSOCKET BACKEND SYNCING
import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Line } from "react-chartjs-2";

const SOCKET_URL = "wss://strategy-market-domination.onrender.com";

export default function App() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [teams, setTeams] = useState([]);
  const [instructorMode, setInstructorMode] = useState(false);
  const [roundHistory, setRoundHistory] = useState([]);
  const [shock, setShock] = useState("none");

  useEffect(() => {
    const socket = new WebSocket(SOCKET_URL);
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "init") {
        setTeams(msg.state.teams || []);
        setRoundHistory(msg.state.roundHistory || []);
        setShock(msg.state.shock || "none");
      }
      if (msg.type === "teamUpdate") setTeams(msg.teams);
      if (msg.type === "shockUpdate") setShock(msg.shock);
      if (msg.type === "roundResolved") {
        setTeams(msg.teams);
        setRoundHistory(msg.history);
      }
    };
    socket.onclose = () => setConnected(false);
    return () => socket.close();
  }, []);

  const send = (obj) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(obj));
    }
  };

  const addTeam = () => send({ type: "join", team: { name: `Team ${teams.length + 1}`, capacity: "Low", price: "", marketing: { ad:false, rep:false, rnd:false } }});
  const updateTeam = (i,f,v)=>send({type:"updateTeam",index:i,update:{[f]:v}});
  const updateMarketing = (i,f,c)=>send({type:"updateTeam",index:i,update:{marketing:{...teams[i].marketing,[f]:c}}});
  const applyShock = (v)=>{setShock(v);send({type:"applyShock",shock:v})};
  const resolveRound = ()=>send({type:"resolveRound"});

  return (<div><h1>Market Domination Challenge</h1></div>);
}
