import { useRouter } from "expo-router";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSignOut } from "../http/generated/authentication/authentication";
import { useFindMe } from "../http/generated/user/user";
import { queryClient } from "../lib/react-query";
import { clearSession, hasSession, subscribeSession } from "../lib/session";

interface AuthContextProps {
  isReady: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextProps>(
  {} as AuthContextProps
);

export const AuthContextProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const prevAuth = useRef<boolean | null>(null);

  const { mutateAsync: signOut } = useSignOut();

  // Warma o cache do usuário/centro quando logado e online. Offline ele
  // resolve pelo cache persistido; a falha de rede não afeta a autenticação.
  useFindMe({
    query: {
      enabled: isAuthenticated,
    },
  });

  // Estado inicial deriva do token local (não da rede) + assinatura reativa.
  useEffect(() => {
    let mounted = true;

    hasSession().then((authed) => {
      if (!mounted) return;
      setIsAuthenticated(authed);
      setIsReady(true);
    });

    const unsubscribe = subscribeSession((authed) => {
      setIsAuthenticated(authed);
      // Qualquer saída (logout ou refresh negado): o próximo usuário não vê
      // dados do anterior. O outbox fica (filtrado por userId).
      if (!authed) queryClient.clear();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Redireciona apenas em transições reais de autenticação.
  useEffect(() => {
    if (!isReady) return;
    if (prevAuth.current === isAuthenticated) return;
    prevAuth.current = isAuthenticated;

    const timeout = setTimeout(() => {
      if (isAuthenticated) {
        router.replace("/authenticated/(tabs)");
      } else {
        router.replace("/public/signin");
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [isReady, isAuthenticated]);

  async function logout() {
    try {
      // signOut é best-effort: offline ele falha, mas a sessão local já sai.
      signOut().catch(() => undefined);
      await clearSession(); // emite false -> efeito acima redireciona ao signin
    } catch (error) {
      console.error("Error logging out:", error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isAuthenticated,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
