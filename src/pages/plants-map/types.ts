export interface MapPlant {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  typeId: string | null;
  typeName: string;
  color: string;
  offline: boolean;
  /** Registro original (online ou offline) para exibir detalhes. */
  raw: any;
}

export type MapItem =
  | { kind: "point"; key: string; plant: MapPlant }
  | {
      kind: "cluster";
      key: string;
      latitude: number;
      longitude: number;
      count: number;
      plants: MapPlant[];
    };

export interface MapFilters {
  /** Tipos selecionados; vazio = todos. */
  typeIds: string[];
  showOnline: boolean;
  showOffline: boolean;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}
