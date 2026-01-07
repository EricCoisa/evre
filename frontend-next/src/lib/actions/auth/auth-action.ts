"use client";

import { LoginFormData } from "@/lib/schemas/login.schema";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LoginRequest, LoginResponse } from "./types";
import { APINEXT } from "@/lib/api/apiNext";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { set } from "zod";

export async function loginClient(data: LoginFormData, router: AppRouterInstance): Promise<LoginResponse> {
   const loginResult = await login(data);
   router.push(loginResult.user.routes.find(route => route.isHome)?.path || "/home");
   router.refresh();
   return loginResult;
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
   return await APINEXT.POST<LoginResponse>('/auth/login', credentials);
}

export async function refresh(): Promise<void> {
   return await APINEXT.POST('/auth/refresh');
}

export async function logout(msg?: string | undefined): Promise<void> {
   function redirectToLogin() {
      localStorage.clear();
      redirect('/login');
   }

   try {
      await APINEXT.POST('/auth/logout');
   } catch {
      console.error('Erro ao fazer logout, redirecionando para a página de login.');
   }
   if (msg != undefined) {
      toast.info(msg);
      setTimeout(() => {
         redirectToLogin();
      }, 3000);
   } else {
      redirectToLogin()
   }


}
