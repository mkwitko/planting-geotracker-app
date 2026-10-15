import { createContext, useContext, useState } from "react";
import { Pressable, PressableProps, View, ViewProps } from "react-native";

import { cn } from "@/src/lib/utils";

interface TabsContextProps {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextProps>({} as TabsContextProps);

export function Tabs({ className, ...props }: ViewProps) {
  const [value, setValue] = useState("");

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <View className={(cn("w-full gap-4 flex-1"), className)} {...props} />
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: ViewProps) {
  return (
    <View
      className={
        (cn("flex-row items-start w-full px-4 h-16 mt-4 gap-2"), className)
      }
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  onPress,
  ...props
}: PressableProps & { value: string }) {
  const { value: ctxValue, setValue } = useContext(TabsContext);
  const isActive = ctxValue === value;

  return (
    <Pressable
      className={cn(
        "border-b h-full flex-row items-center justify-center gap-2 flex-1 border-zinc-400",
        isActive && "border-red-500 border-b-2"
      )}
      onPress={(event) => {
        setValue(value);
        onPress?.(event);
      }}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ViewProps & { value: string }) {
  const { value: ctxValue } = useContext(TabsContext);
  const isActive = ctxValue === props.value;

  if (!isActive) return null;

  return <View className={className} {...props} />;
}
