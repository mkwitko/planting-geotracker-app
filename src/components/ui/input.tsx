import { cn } from "@/src/lib/utils";
import * as React from "react";
import { Platform, TextInput, TextInputProps, View } from "react-native";

interface InputProps extends TextInputProps {
  error?: boolean;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, error = false, readOnly = false, ...props }, ref) => {
    return (
      <View
        className={cn(
          "w-full bg-white px-4 flex items-center flex-row h-14 rounded-xl border border-zinc-200",
          error && "border-red-600"
        )}
      >
        <TextInput
          ref={ref}
          readOnly={readOnly}
          className={cn(
            "h-full font-body bg-transparent flex-1 text-lg placeholder:text-zinc-400",
            className,
            Platform.OS === "ios" && "mb-2.5",
            readOnly && "text-zinc-400"
          )}
          {...props}
        />
      </View>
    );
  }
);
