"use client";
import { Button } from "@/components/ui/button";
import LangLabel from "@/components/ui/langLabel";
import Link from 'next/link';

export default function NotFound() {

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-primary">
            <div className="bg-card text-secondary rounded-xl shadow-2xl p-10 flex flex-col items-center">
                <h1 className="text-7xl font-extrabold text-primary mb-4 drop-shadow-lg">404</h1>
                <h2 className="text-2xl font-bold mb-2 text-primary"><LangLabel text="pageNotFound" /></h2>
                <p className="text-lg text-primary mb-6"><LangLabel text="pageNotFoundDescription" /></p>
                <Button asChild><Link href="/"><LangLabel text="backToHome" /></Link></Button>
            </div>
        </div>
    )
}
