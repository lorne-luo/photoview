package routes

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/photoview/photoview/api/graphql/auth"
	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/log"
	"gorm.io/gorm"
)

const maxUploadSize = 500 << 20 // 500 MB

func RegisterUploadRoutes(db *gorm.DB, router *mux.Router) {
	router.HandleFunc("/{albumId}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		user := auth.UserFromContext(r.Context())
		if user == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		albumIdStr := mux.Vars(r)["albumId"]
		albumId, err := strconv.Atoi(albumIdStr)
		if err != nil {
			http.Error(w, "Invalid album ID", http.StatusBadRequest)
			return
		}

		// Verify user owns this album
		var album models.Album
		err = db.
			Joins("JOIN user_albums ON user_albums.album_id = albums.id").
			Where("albums.id = ? AND user_albums.user_id = ?", albumId, user.ID).
			First(&album).Error
		if err != nil {
			log.Error(r.Context(), "Album not found or user doesn't have access", "album_id", albumId, "user_id", user.ID, "error", err)
			http.Error(w, "Album not found or access denied", http.StatusNotFound)
			return
		}

		// Limit upload size
		r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

		if err := r.ParseMultipartForm(maxUploadSize); err != nil {
			log.Error(r.Context(), "Failed to parse multipart form", "error", err)
			http.Error(w, "File too large or invalid form", http.StatusBadRequest)
			return
		}

		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			http.Error(w, "No files provided", http.StatusBadRequest)
			return
		}

		uploadedCount := 0
		for _, fileHeader := range files {
			// Check if file is a supported media type
			ext := filepath.Ext(fileHeader.Filename)
			if !isValidMediaExtension(ext) {
				log.Warn(r.Context(), "Skipping unsupported file type", "filename", fileHeader.Filename, "extension", ext)
				continue
			}

			// Open the uploaded file
			file, err := fileHeader.Open()
			if err != nil {
				log.Error(r.Context(), "Failed to open uploaded file", "filename", fileHeader.Filename, "error", err)
				continue
			}
			defer file.Close()

			// Create destination path
			destPath := filepath.Join(album.Path, fileHeader.Filename)

			// Check if file already exists
			if _, err := os.Stat(destPath); err == nil {
				log.Warn(r.Context(), "File already exists, skipping", "path", destPath)
				continue
			}

			// Create destination file
			destFile, err := os.Create(destPath)
			if err != nil {
				log.Error(r.Context(), "Failed to create destination file", "path", destPath, "error", err)
				continue
			}

			// Copy the file
			_, err = io.Copy(destFile, file)
			destFile.Close()
			if err != nil {
				log.Error(r.Context(), "Failed to copy file", "path", destPath, "error", err)
				os.Remove(destPath) // Clean up partial file
				continue
			}

			log.Info(r.Context(), "Successfully uploaded file", "path", destPath)
			uploadedCount++
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"success": true, "uploaded": %d, "albumId": %d}`, uploadedCount, albumId)
	}).Methods("POST")
}

// isValidMediaExtension checks if the file extension is a supported media type
func isValidMediaExtension(ext string) bool {
	supportedExtensions := []string{
		// Image formats
		".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif",
		".heic", ".heif", ".avif", ".cr2", ".nef", ".arw", ".dng", ".orf", ".rw2",
		// Video formats
		".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv", ".3gp", ".mpeg", ".mpg",
	}
	
	extLower := strings.ToLower(ext)
	for _, supported := range supportedExtensions {
		if extLower == supported {
			return true
		}
	}
	return false
}
