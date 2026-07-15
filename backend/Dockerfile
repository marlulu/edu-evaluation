# ---- Build Stage ----
FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /app

# 配置阿里云 Maven 镜像（国内加速）
RUN mkdir -p ~/.m2 && cat > ~/.m2/settings.xml <<'EOF'
<settings>
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <name>Aliyun Maven Mirror</name>
      <url>https://maven.aliyun.com/repository/public</url>
      <mirrorOf>central</mirrorOf>
    </mirror>
  </mirrors>
</settings>
EOF

COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

# ---- Production Stage ----
FROM eclipse-temurin:17-jre-alpine
RUN apk add --no-cache curl docker-cli fontconfig ttf-dejavu \
    && mkdir -p /usr/share/fonts/chinese \
    && fc-cache -fv
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# 由 docker-compose 注入环境变量
ENV JAVA_OPTS="-Xms256m -Xmx512m"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
