import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width: screenWidth } = Dimensions.get("window");

export interface ModalAction {
  text: string;
  onPress: () => void;
  style?: "primary" | "secondary" | "danger" | "success";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface CustomModalProps {
  visible: boolean;
  onClose?: () => void;

  // Conteúdo
  title: string;
  message: string;
  subtitle?: string;

  // Ícone
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBackgroundColor?: string;

  // Ações
  actions: ModalAction[];

  // Configurações
  maxWidth?: number;
  dismissible?: boolean;

  // Animação
  animationDuration?: number;
}

const getButtonStyle = (
  style: ModalAction["style"] = "primary",
  loading?: boolean
) => {
  const baseStyle = "flex-1 py-4 rounded-2xl";

  if (loading) {
    return `${baseStyle} bg-gray-400`;
  }

  switch (style) {
    case "primary":
      return `${baseStyle} bg-green-500`;
    case "secondary":
      return `${baseStyle} border-2 border-gray-200`;
    case "danger":
      return `${baseStyle} bg-red-500`;
    case "success":
      return `${baseStyle} bg-green-500`;
    default:
      return `${baseStyle} bg-gray-500`;
  }
};

const getTextStyle = (style: ModalAction["style"] = "primary") => {
  const baseStyle = "text-center font-semibold text-base";

  switch (style) {
    case "secondary":
      return `${baseStyle} text-gray-700`;
    default:
      return `${baseStyle} text-white`;
  }
};

export const CustomModal = ({
  visible,
  onClose,
  title,
  message,
  subtitle,
  icon = "alert-circle",
  iconColor = "#EF4444",
  iconBackgroundColor = "#FEF2F2",
  actions,
  maxWidth = 400,
  dismissible = true,
  animationDuration = 200,
}: CustomModalProps) => {
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: animationDuration * 0.75,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, animationDuration]);

  const handleBackdropPress = () => {
    if (dismissible && onClose) {
      onClose();
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        activeOpacity={1}
        onPress={handleBackdropPress}
      >
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            opacity: opacityAnim,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View
              style={{
                transform: [{ scale: scaleAnim }],
                width: screenWidth - 40,
                maxWidth,
              }}
              className="bg-white rounded-3xl p-6 shadow-2xl"
            >
              {/* Ícone */}
              <View className="items-center mb-6">
                <View
                  className="w-20 h-20 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: iconBackgroundColor }}
                >
                  <Ionicons name={icon} size={40} color={iconColor} />
                </View>

                {/* Título */}
                <Text className="text-xl font-bold text-gray-900 text-center mb-2">
                  {title}
                </Text>

                {/* Mensagem */}
                <Text className="text-gray-600 text-center leading-6">
                  {message}
                </Text>

                {/* Subtítulo (opcional) */}
                {subtitle && (
                  <Text className="text-red-500 text-sm text-center mt-2 font-medium">
                    {subtitle}
                  </Text>
                )}
              </View>

              {/* Botões */}
              <View className={`flex-row ${actions.length > 1 ? "gap-4" : ""}`}>
                {actions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={action.onPress}
                    disabled={action.disabled || action.loading}
                    className={`${getButtonStyle(
                      action.style,
                      action.loading
                    )} ${
                      action.disabled || action.loading ? "opacity-50" : ""
                    }`}
                  >
                    <View className="flex-row items-center justify-center">
                      {action.loading ? (
                        <>
                          <ActivityIndicator size="small" color="white" />
                          <Text
                            className={`${getTextStyle(action.style)} ml-2`}
                          >
                            {action.text}
                          </Text>
                        </>
                      ) : (
                        <>
                          {action.icon && (
                            <Ionicons
                              name={action.icon}
                              size={18}
                              color={
                                action.style === "secondary"
                                  ? "#374151"
                                  : "white"
                              }
                            />
                          )}
                          <Text
                            className={`${getTextStyle(action.style)} ${
                              action.icon ? "ml-2" : ""
                            }`}
                          >
                            {action.text}
                          </Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

export default CustomModal;
