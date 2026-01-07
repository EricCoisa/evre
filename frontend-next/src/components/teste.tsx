import { Either } from "@/lib/utils";

export interface Props0<T extends HTMLElement = HTMLElement> extends React.HTMLAttributes<T> {
 children: React.ReactNode;
}

export interface Props1 {
  title:string
  desrict:string
}

export interface Props2 {
    desrict3:string
      desrict2:string
}

export type FileSelectorProps = Props0 & Either<Props1, Props2>;


export function Componente (props : FileSelectorProps) {

    return <div>Teste</div>;
}