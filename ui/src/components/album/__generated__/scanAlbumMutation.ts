/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL mutation operation: scanAlbumMutation
// ====================================================

export interface scanAlbumMutation_scanAlbum {
  __typename: "ScannerResult";
  success: boolean;
  message: string | null;
}

export interface scanAlbumMutation {
  /**
   * Scan a single album for new media
   */
  scanAlbum: scanAlbumMutation_scanAlbum;
}

export interface scanAlbumMutationVariables {
  albumId: string;
}
