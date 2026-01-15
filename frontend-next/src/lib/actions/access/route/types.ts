export interface Routes {
  id: string;
  path: string;
  labelKey: string;
  icon?: string | null;
  parentId: string | null;
  ordem: number;
  isHome: boolean;
  isActive: boolean;
  showSideBar: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: Routes;
  children?: Routes[];
}

export interface CreateRouteDto {
  path: string;
  labelKey: string;
  icon?: string;
  parentId?: string | null;
  ordem?: number;
  isHome?: boolean;
  isActive?: boolean;
  showSideBar?: boolean;
}

export interface UpdateRouteDto {
  path?: string;
  labelKey?: string;
  icon?: string | null;
  parentId?: string | null;
  ordem?: number;
  isHome?: boolean;
  isActive?: boolean;
  showSideBar?: boolean;
}