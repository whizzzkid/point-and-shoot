import {ReactNode} from 'react';
export interface ToastProps{tone?:'neutral'|'success'|'danger';children?:ReactNode;onClose?:()=>void}
