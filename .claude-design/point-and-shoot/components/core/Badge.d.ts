import {ReactNode} from 'react';
export interface BadgeProps{children?:ReactNode;tone?:'neutral'|'accent'|'success'|'warning'|'danger'}
export interface TagProps{children?:ReactNode;onRemove?:()=>void}
