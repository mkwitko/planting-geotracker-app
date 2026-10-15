import {
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Platform,
  View,
} from 'react-native'

interface DialogProps extends ModalProps {
  children: React.ReactNode
  open: boolean
  withInteractivity?: boolean
}

export function Dialog({
  children,
  open,
  withInteractivity = false,
  ...rest
}: DialogProps) {
  const content = withInteractivity ? (
    <KeyboardAvoidingView
      className="bg-black/80 items-center justify-center flex-1 px-4"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {children}
    </KeyboardAvoidingView>
  ) : (
    <View className="bg-black/80 items-center justify-center w-full flex-1 px-4">
      {children}
    </View>
  )

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      {...rest}
    >
      {content}
    </Modal>
  )
}
