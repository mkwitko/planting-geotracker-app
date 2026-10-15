import * as React from "react";
import { Platform, TextInput, TextInputProps, View } from "react-native";

import { cn } from "@/src/lib/utils";

interface MultilineInputProps extends TextInputProps {
  error?: boolean;
}

export const MultilineInput = React.forwardRef<TextInput, MultilineInputProps>(
  ({ className, error = false, readOnly = false, ...props }, ref) => {
    return (
      <View
        className={cn(
          "w-full bg-white px-4 flex items-center flex-row h-32 rounded-xl border border-zinc-200",
          error && "border-red-600"
        )}
      >
        <TextInput
          ref={ref}
          readOnly={readOnly}
          numberOfLines={4}
          className={cn(
            "h-full bg-transparent font-body flex-1 text-lg placeholder:text-zinc-400",
            className,
            Platform.OS === "ios" && "mb-20",
            readOnly && "text-zinc-400"
          )}
          {...props}
        />
      </View>
    );
  }
);
