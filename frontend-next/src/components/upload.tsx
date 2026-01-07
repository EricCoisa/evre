import { Label } from "@radix-ui/react-dropdown-menu";
import { Input } from "./ui/input";
import { UploadCloud } from "lucide-react"; // You may need to install lucide-react

import React, { useRef } from "react";

export interface UploadProps {
    title?: string;
    name?: string;
    children?: React.ReactNode;
    type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
    accept?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Upload({ title, name, children, type = "file", accept, onChange }: UploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleMaskClick = () => {
        inputRef.current?.click();
    };

    const mask = () => (
        <div
            className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-40 hover:opacity-90 transition-opacity cursor-pointer z-10 rounded-full"
            style={{ pointerEvents: "auto" }}
            onClick={handleMaskClick}
        >
            <UploadCloud size={48} className="text-white" />
        </div>
    );

    return (
        <div>
            {title && <Label>{title}</Label>}
            <div className="relative inline-block">
                {children}
                {mask()}
            </div>
            <Input
                name={name}
                type={type}
                ref={inputRef}
                className="hidden"
                accept={accept}
                onChange={onChange}
            />
        </div>
    );
}