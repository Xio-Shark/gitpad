export interface Settings {
  showHidden: boolean;
  showNodeModules: boolean;
}

export const settings = $state<Settings>({
  showHidden: false,
  showNodeModules: false,
});
