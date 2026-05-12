"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ShagunLogo } from "@/components/ui/shagun-logo"
import { api, ApiError } from "@/lib/api"

const schema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter 10-digit phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "", password: "" },
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      await api.post("/api/auth/login", values)
      toast.success("Welcome back!")
      router.push("/events")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Login failed"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <ShagunLogo size="lg" className="mx-auto mb-2" />
          <CardTitle className="text-2xl font-bold text-primary">Shagun</CardTitle>
          <CardDescription>Sign in to manage your event</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="10-digit mobile number"
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input placeholder="••••••" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
