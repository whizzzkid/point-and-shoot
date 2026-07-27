import {ReactNode} from 'react';
export interface ButtonProps{
variant?:'primary'|'secondary'|'ghost'|'danger';
size?:'sm'|'md'|'lg';
icon?:ReactNode;
children?:ReactNode;
disabled?:boolean;
onClick?:()=>void;
}
