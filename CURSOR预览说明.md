# Cursor 内置预览 vs 浏览器显示差异说明

## 问题原因

你的项目使用了 **Tailwind CSS**，这是一个需要编译的 CSS 框架。Cursor 内置的浏览器预览可能无法正确处理 Tailwind CSS 的编译，导致样式显示不正确。

### 主要原因：

1. **Tailwind CSS 需要编译**
   - Tailwind 使用 `@tailwind` 指令，需要通过 PostCSS 和 Vite 编译
   - Cursor 的预览可能没有经过完整的构建流程

2. **开发服务器未运行**
   - Cursor 预览可能直接打开 HTML 文件，而不是通过 Vite 开发服务器
   - Vite 开发服务器会实时编译 Tailwind CSS

3. **CSS 文件未正确加载**
   - 预览可能无法加载编译后的 CSS
   - 或者 CSS 路径不正确

## 解决方案

### ✅ 推荐方案：使用浏览器访问开发服务器

**不要使用 Cursor 内置预览，而是：**

1. **确保开发服务器正在运行**：
   ```bash
   cd frontend
   npm run dev
   # 或
   npm run dev:host  # 如果需要外网访问
   ```

2. **在浏览器中打开**：
   - 打开浏览器（Chrome、Firefox、Safari 等）
   - 访问：`http://localhost:3000`
   - 这样可以看到正确的样式

### 🔧 为什么浏览器显示正确？

- ✅ 浏览器通过 Vite 开发服务器访问
- ✅ Vite 会实时编译 Tailwind CSS
- ✅ 所有 CSS 类都会被正确应用
- ✅ 支持热更新（HMR）

### ❌ 为什么 Cursor 预览显示不正确？

- ❌ 可能直接打开静态 HTML 文件
- ❌ 没有经过 Vite 编译流程
- ❌ Tailwind CSS 未编译，样式未应用
- ❌ 可能缺少某些 JavaScript 功能

## 验证方法

### 1. 检查开发服务器是否运行

```bash
# 检查端口 3000 是否被占用
lsof -i :3000
```

### 2. 检查浏览器控制台

在浏览器中按 `F12` 打开开发者工具：
- 查看 **Console** 标签：是否有错误
- 查看 **Network** 标签：CSS 文件是否加载成功
- 查看 **Elements** 标签：检查元素是否有 Tailwind 类名

### 3. 检查 CSS 是否正确加载

在浏览器中：
1. 按 `F12` 打开开发者工具
2. 查看 **Network** 标签
3. 刷新页面
4. 查找 `index.css` 文件，应该能看到编译后的 Tailwind CSS

## 常见问题

### Q: Cursor 预览能修复吗？

A: 理论上可以，但需要：
- Cursor 支持通过开发服务器预览（而不是直接打开文件）
- 或者 Cursor 内置 Tailwind CSS 编译器

**建议**：直接使用浏览器访问开发服务器，这是最可靠的方式。

### Q: 为什么有些页面在 Cursor 预览中看起来正常？

A: 可能：
- 使用了内联样式（不受影响）
- 使用了基础 HTML 样式
- 但 Tailwind 的响应式、工具类等不会生效

### Q: 生产环境构建后会有问题吗？

A: 不会。生产环境使用 `npm run build` 构建，会正确编译所有 CSS：
```bash
cd frontend
npm run build
npm run preview  # 预览生产构建
```

## 最佳实践

1. **开发时**：始终使用浏览器访问 `http://localhost:3000`
2. **不要依赖** Cursor 内置预览来查看样式
3. **使用浏览器开发者工具**调试样式问题
4. **生产构建**：使用 `npm run build` 构建，然后用 `npm run preview` 预览

## 快速检查清单

- [ ] 开发服务器正在运行（`npm run dev`）
- [ ] 在浏览器中访问 `http://localhost:3000`
- [ ] 浏览器控制台没有错误
- [ ] CSS 文件正确加载（Network 标签）
- [ ] Tailwind 类名正确应用（Elements 标签）

---

**总结**：Cursor 内置预览不适合查看需要编译的 CSS 框架（如 Tailwind CSS）。请始终使用浏览器访问开发服务器来查看正确的效果。

