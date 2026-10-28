'use client';

import { Label } from "@radix-ui/react-dropdown-menu";
import { Input } from "./ui/input";
import { UploadCloud } from "lucide-react";
import React, { useRef } from "react";
import { useStorageHealth } from "@/lib/actions/user/queries";

export interface UploadProps {
    title?: string;
    name?: string;
    children?: React.ReactNode;
    type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
    accept?: string;
    disabled?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Upload({ title, name, children, type = "file", accept, disabled, onChange }: UploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { data: storageHealth } = useStorageHealth();
    const isDisabled = disabled || storageHealth?.operational === false;

    const handleMaskClick = () => {
        if (!isDisabled) inputRef.current?.click();
    };

    const mask = () => (
        <div
            className={`absolute inset-0 flex items-center justify-center bg-black/10 opacity-40 transition-opacity z-10 rounded-full ${isDisabled ? 'cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}`}
            style={{ pointerEvents: "auto" }}
            onClick={handleMaskClick}
        >
            <UploadCloud size={48} className={isDisabled ? 'text-muted-foreground' : 'text-white'} />
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
                disabled={isDisabled}
                onChange={onChange}
            />
        </div>
    );
}