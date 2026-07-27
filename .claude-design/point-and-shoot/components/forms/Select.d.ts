export interface SelectOption{label:string;value:string}
export interface SelectProps{
options:(SelectOption|string)[];
value?:string;
onChange?:(v:string)=>void;
}
