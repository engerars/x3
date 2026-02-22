    (function () {
      const MAX_RETRIES = 3;
      const RETRY_KEY = "app_resource_retries";

      function attemptReload(reason) {
        let retries = parseInt(sessionStorage.getItem(RETRY_KEY) || "0");
        if (retries < MAX_RETRIES) {
          sessionStorage.setItem(RETRY_KEY, retries + 1);
          console.warn(
            `[Auto-Fix] ${reason}. Đang tải lại trang (Lần ${retries + 1
            }/${MAX_RETRIES})...`
          );

          document.documentElement.innerHTML = `
              <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;flex-direction:column;text-align:center;">
                <h2 style="color:#d63384">Đang khắc phục sự cố kết nối...</h2>
                <p>Hệ thống đang tự động tải lại tài nguyên (Lần ${retries + 1
            }). Vui lòng đợi giây lát.</p>
              </div>
            `;

          setTimeout(() => window.location.reload(), 1500);
        } else {
          console.error(
            "[Auto-Fix] Đã hết lượt thử lại. Vui lòng kiểm tra kết nối mạng."
          );
          sessionStorage.removeItem(RETRY_KEY);
          alert(
            "Lỗi kết nối: Không thể tải thư viện hệ thống (Dexie/Vue). Vui lòng kiểm tra đường truyền internet và nhấn F5."
          );
        }
      }

      window.addEventListener(
        "error",
        function (e) {
          if (
            e.target &&
            (e.target.tagName === "SCRIPT" || e.target.tagName === "LINK")
          ) {
            if (e.target.src && !e.target.src.startsWith("http")) return;

            attemptReload(
              `Không tải được tài nguyên: ${e.target.src || "Unknown Source"}`
            );
          }
        },
        true
      );

      window.addEventListener("load", function () {
        setTimeout(() => {
          const missingLibs = [];
          if (typeof Vue === "undefined") missingLibs.push("Vue");
          if (typeof Dexie === "undefined") missingLibs.push("Dexie");

          if (missingLibs.length > 0) {
            attemptReload(`Thiếu thư viện: ${missingLibs.join(", ")}`);
          } else {
            sessionStorage.removeItem(RETRY_KEY);
            console.log("[System] Tất cả thư viện đã tải thành công.");
          }
        }, 500);
      });
    })();
