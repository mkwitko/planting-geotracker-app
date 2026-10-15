import { Input } from "@/src/components/ui/input";
import { SecureInput } from "@/src/components/ui/secure-input";
import { useAuthContext } from "@/src/context/auth-context";
import { Feather } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { SplashScreen, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { useSignIn } from "@/src/http/generated/authentication/authentication";
import { saveSession } from "@/src/lib/session";

import { z } from "zod";

const signInFormSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type SignInFormSchema = z.infer<typeof signInFormSchema>;

export default function SignInPage() {
  const router = useRouter();
  const { isReady } = useAuthContext();

  const { mutateAsync: signIn } = useSignIn();

  const [authError, setAuthError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormSchema>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function handleSignIn(data: SignInFormSchema) {
    setAuthError(null);
    try {
      const res = await signIn({
        data: {
          email: data.email.toLowerCase(),
          password: data.password,
        },
      });
      if (res.accessToken && res.refreshToken) {
        // saveSession emite o estado logado -> auth-context redireciona.
        await saveSession(res.accessToken, res.refreshToken);
        router.replace("/authenticated/(tabs)");
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message ??
        (status === 403
          ? "Sem acesso ao aplicativo"
          : status === 400
            ? "Credenciais inválidas"
            : "Não foi possível entrar. Tente novamente.");
      setAuthError(message);
    }
  }

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  return (
    <KeyboardAvoidingView
      className="flex-1 items-center justify-center"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View className="w-full bg-gray-100 px-4">
        <View className="items-center mb-8">
          <Image
            source={require("@/assets/images/splash-icon.png")}
            style={{ width: 220, height: 75 }}
            contentFit="contain"
          />
          <Text className="mt-3 text-zinc-500 text-base">
            Faça login para continuar
          </Text>
        </View>

        <View className="gap-4 w-full">
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <View className="gap-1">
                <Input
                  value={field.value}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  onChangeText={field.onChange}
                  placeholder="Digite seu e-mail"
                  error={!!errors.email?.message}
                  blurOnSubmit={false}
                />

                {errors.email?.message && (
                  <Text className="text-red-600">{errors.email.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <View className="gap-1">
                <SecureInput
                  value={field.value}
                  keyboardType="default"
                  onChangeText={field.onChange}
                  placeholder="Digite sua senha"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(handleSignIn)}
                  error={!!errors.password?.message}
                />

                {errors.password?.message && (
                  <Text className="text-red-600">
                    {errors.password.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* <TouchableOpacity
                  onPress={() => router.push('/forgot-password')}
                  activeOpacity={0.7}
                >
                  <Text className="text-zinc-400 text-right font-light">
                    Esqueci minha senha
                  </Text>
                </TouchableOpacity> */}
        </View>

        <View className="gap-2 w-full mt-4">
          <Pressable
            onPress={handleSubmit(handleSignIn)}
            disabled={isSubmitting}
            className="bg-green-600 w-full h-12 disabled:opacity-50 rounded-md flex items-center justify-center flex-row gap-2"
          >
            {isSubmitting && (
              <View className="animate-spin">
                <Feather color="#FFFFFF" name="loader" size={20} />
              </View>
            )}
            <Text className="text-lg font-bold text-white">Entrar</Text>
          </Pressable>

          {authError && (
            <Text className="text-red-600 text-center">{authError}</Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
