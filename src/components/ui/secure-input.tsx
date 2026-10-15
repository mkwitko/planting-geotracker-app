import { Feather } from "@expo/vector-icons";
import * as React from "react";
import {
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

import { cn } from "@/src/lib/utils";

interface SecureInputProps extends TextInputProps {
  error?: boolean;
}

export const SecureInput = React.forwardRef<TextInput, SecureInputProps>(
  ({ className, error, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);

    return (
      <View
        className={cn(
          "w-full bg-white px-4 flex items-center flex-row h-14 rounded-xl border border-zinc-200",
          error && "border-red-600"
        )}
      >
        <TextInput
          ref={ref}
          textContentType="password"
          className={cn(
            "flex-1 font-body text-lg text-zinc-900 placeholder:text-zinc-400",
            className
          )}
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          keyboardType="default"
          {...props}
        />

        <TouchableOpacity
          onPress={() => setIsVisible(!isVisible)}
          activeOpacity={0.7}
        >
          <Feather
            size={20}
            color="#a1a1aa"
            name={isVisible ? "eye-off" : "eye"}
          />
        </TouchableOpacity>
      </View>
    );
  }
);
