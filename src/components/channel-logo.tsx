"use client";
import { useState } from "react";
export function ChannelLogo({src,name}:{src:string;name:string}){const[bad,setBad]=useState(!src);if(bad)return <span className="channel-logo-fallback" aria-label={name+" logo"}>{name.slice(0,2).toUpperCase()}</span>;return <img className="channel-logo" src={src} alt={name+" logo"} loading="lazy" onError={()=>setBad(true)}/>}