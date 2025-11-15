# Hướng dẫn Debug - Thêm/Sửa Sản phẩm không hoạt động

## Các bước kiểm tra và debug:

### 1. Kiểm tra API Server
- Đảm bảo API server đang chạy trên `http://localhost:5000`
- Test bằng curl:
```bash
curl -X GET "http://localhost:5000/api/Products?page=1&pageSize=5"
```

### 2. Kiểm tra trong Angular App
1. Mở ứng dụng Angular (thường là `http://localhost:4200`)
2. Điều hướng đến trang Product List
3. Click các nút test:
   - **🔗 Test API**: Kiểm tra kết nối API
   - **🧪 Test Create**: Test tạo sản phẩm đơn giản
   - **🧪 Test CRUD**: Test tất cả CRUD operations

### 3. Kiểm tra Console Logs
Mở Developer Tools (F12) và xem Console tab:
- Tìm các log bắt đầu với `=== SAVE PRODUCT CALLED ===`
- Kiểm tra lỗi network trong Network tab
- Xem các error messages chi tiết

### 4. Test API trực tiếp
Mở file `test-api-simple.html` trong browser để test API trực tiếp:
- Test GET products
- Test CREATE product
- Xem response và error messages

### 5. Các lỗi thường gặp:

#### A. CORS Error
```
Access to fetch at 'http://localhost:5000/api/Products' from origin 'http://localhost:4200' has been blocked by CORS policy
```
**Giải pháp**: Cấu hình CORS trong API server

#### B. Network Error
```
Failed to fetch
```
**Giải pháp**: Kiểm tra API server có chạy không

#### C. Validation Error
```
Vui lòng nhập tên sản phẩm!
```
**Giải pháp**: Điền đầy đủ thông tin form

#### D. API Response Error
```
HTTP error! status: 400
```
**Giải pháp**: Kiểm tra format dữ liệu gửi lên API

### 6. Debug Steps:

1. **Kiểm tra form validation**:
   - Điền đầy đủ tên, giá, tồn kho
   - Xem console logs validation

2. **Kiểm tra API request**:
   - Mở Network tab trong DevTools
   - Click "Thêm sản phẩm" và submit form
   - Xem request được gửi đi
   - Kiểm tra response

3. **Kiểm tra error handling**:
   - Xem error messages trong UI
   - Kiểm tra console logs
   - Test với dữ liệu khác nhau

### 7. Test Cases:

#### Test Case 1: Tạo sản phẩm mới
```
Tên: "Test Product"
Mô tả: "Test Description"  
Giá: 100000
Tồn kho: 10
```

#### Test Case 2: Sửa sản phẩm
- Click nút ✏️ trên sản phẩm hiện có
- Thay đổi tên và giá
- Click "Cập nhật"

#### Test Case 3: Validation
- Để trống tên sản phẩm → Phải hiện lỗi
- Nhập giá âm → Phải hiện lỗi
- Nhập tồn kho âm → Phải hiện lỗi

### 8. Files quan trọng:

- `src/app/product-list/product-list.ts` - Component chính
- `src/app/services/product.ts` - Service gọi API
- `src/app/product-list/product-list.html` - Template form
- `test-api-simple.html` - Test API trực tiếp

### 9. Console Commands để debug:

```javascript
// Trong browser console
fetch('http://localhost:5000/api/Products?page=1&pageSize=5')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

### 10. Nếu vẫn không hoạt động:

1. Kiểm tra API server logs
2. Kiểm tra Angular build errors
3. Thử với Postman hoặc curl
4. Kiểm tra CORS settings
5. Xem Network tab trong DevTools
















