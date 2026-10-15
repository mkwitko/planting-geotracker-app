import { createNotifications } from "react-native-notificated";
import { colors } from "../lib/colors";

const { useNotifications, notify, NotificationsProvider } = createNotifications(
  {
    defaultStylesSettings: {
      darkMode: false,
      errorConfig: {
        bgColor: colors.red[400],
        titleColor: colors.white,
        titleSize: 18,
        descriptionColor: colors.white,
        descriptionSize: 16,
        notificationPosition: "top",
        defaultIconType: "no-icon",
        borderRadius: 8,
        multiline: 2,
      },
      successConfig: {
        bgColor: colors.green[400],
        titleColor: colors.white,
        titleSize: 18,
        descriptionColor: colors.white,
        descriptionSize: 16,
        notificationPosition: "top",
        defaultIconType: "no-icon",
        borderRadius: 8,
        multiline: 2,
      },
    },
  }
);

export { NotificationsProvider, notify, useNotifications };
