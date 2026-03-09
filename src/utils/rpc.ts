import { invoke } from '@tauri-apps/api';

export interface RpcConfig {
  client_id: string;
  state: string;
  details: string;
  large_image: string;
  large_text: string;
  small_image: string;
  small_text: string;
  button_1_text: string;
  button_1_url: string;
  button_2_text: string;
  button_2_url: string;
  enable_timer: boolean;
}

export async function RpcStart(config?: Partial<RpcConfig>): Promise<void> {
  const defaultConfig: RpcConfig = {
    client_id: "1468990040414880061", // Updated Client ID (Placeholder - User should update this)
    state: "patata.leilos.qzz.io",
    details: ":)",
    large_image: "https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg", // Ensure you upload an image named 'logo' to Discord Developer Portal
    large_text: "Leilos Launcher",
    small_image: "none",
    small_text: "none",
    button_1_text: "Leilos Website",
    button_1_url: "https://leilos.qzz.io",
    button_2_text: "none",
    button_2_url: "none",
    enable_timer: true,
  };

  try {
    await invoke("start_rpc", {
      config: { ...defaultConfig, ...config },
    });
    console.log("Discord RPC started");
  } catch (error) {
    console.error("Failed to start Discord RPC:", error);
  }
}

export async function RpcStop(): Promise<void> {
  try {
    await invoke("stop_rpc");
    console.log("RPC stopped");
  } catch (error) {
    console.error("Failed to stop RPC:", error);
  }
}

export async function RpcClear(): Promise<void> {
  try {
    await invoke("clear_rpc");
    console.log("RPC cleared");
  } catch (error) {
    console.error("Failed to clear RPC:", error);
  }
}
