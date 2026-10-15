import { cn } from "@/src/lib/utils";
import * as React from "react";
import { View, Text } from "react-native";

interface CardProps extends React.ComponentPropsWithoutRef<typeof View> {
  className?: string;
}

interface CardTextProps extends React.ComponentPropsWithoutRef<typeof Text> {
  className?: string;
}

const Card = React.forwardRef<View, CardProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(
        "rounded-xl border border-zinc-200 bg-white shadow-sm",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<View, CardProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<Text, CardTextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn("font-semibold text-lg tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<Text, CardTextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn("text-sm text-zinc-500", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<View, CardProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<View, CardProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn("flex flex-row items-center p-6 pt-0", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
