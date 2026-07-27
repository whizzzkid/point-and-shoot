import {ReactNode} from 'react';
export interface IconButtonProps{
icon:ReactNode;
label:string;
size?:number;
active?:boolean;
onClick?:()=>void;
}
