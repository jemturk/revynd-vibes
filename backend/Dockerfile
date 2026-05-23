# 1. Build Layer via lightweight Maven container (Upgraded to Java 21)
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# 2. Execution Layer (Upgraded to Java 21 Runtime)
FROM eclipse-temurin:21-jdk-jammy
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080

# Run using your production configuration settings
ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=prod", "app.jar"]