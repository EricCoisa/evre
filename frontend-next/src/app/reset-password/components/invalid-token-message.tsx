"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export function InvalidTokenMessage() {
    const [seconds, setSeconds] = useState(3)
    const router = useRouter()
    const { t } = useTranslation("forgotPassword")

    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(interval)
                    router.push('/login')
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [router])

    return (
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <Card className="border-destructive">
                <CardHeader className="space-y-1">
                    <div className="flex items-center justify-center mb-4">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">
                        {t('invalidToken')}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {t('invalidTokenMessage', { seconds })}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-sm text-muted-foreground">
                        {t('redirectingToLogin')}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
