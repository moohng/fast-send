# Capacitor 基础规则
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# 忽略 slf4j 相关的警告
-dontwarn org.slf4j.**
-keep class org.slf4j.** { *; }

# 忽略常见的三方库警告
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**
-dontwarn com.google.errorprone.annotations.**

# 保持所有 Capacitor 插件
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class com.fastsend.app.** { *; }

# Lucide Icons / React 相关可能需要的压缩规则
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes EnclosingMethod
-dontwarn com.google.android.gms.**
